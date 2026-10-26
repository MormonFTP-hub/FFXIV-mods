using System;
using System.Buffers.Binary;

namespace VoiceLink.Sync;

/// <summary>
/// Mono Microsoft ADPCM encoder, the codec the game uses for sound effects.
/// Each block starts with a 7-byte header (predictor, step, two raw samples) followed by 4-bit codes.
/// </summary>
internal static class MsAdpcm
{
    private static readonly int[] Coefficient1 = [256, 512, 0, 192, 240, 460, 392];
    private static readonly int[] Coefficient2 = [0, -256, 0, 64, 0, -208, -232];
    private static readonly int[] Adaptation = [230, 230, 230, 230, 307, 409, 512, 614, 768, 614, 512, 409, 307, 230, 230, 230];

    private const int HeaderSize = 7;
    private const int MinStep = 16;

    public static int SamplesPerBlock(int blockAlign) => ((blockAlign - HeaderSize) * 2) + 2;

    /// <summary>Encodes whole blocks; the last one is padded with silence.</summary>
    public static byte[] Encode(ReadOnlySpan<short> samples, int blockAlign)
    {
        var perBlock = SamplesPerBlock(blockAlign);
        var blocks = Math.Max(1, (samples.Length + perBlock - 1) / perBlock);
        var output = new byte[blocks * blockAlign];

        var block = new short[perBlock];
        var trial = new byte[blockAlign];
        var step = MinStep;
        for (var b = 0; b < blocks; b++)
        {
            Array.Clear(block);
            var start = b * perBlock;
            if (start < samples.Length)
                samples.Slice(start, Math.Min(perBlock, samples.Length - start)).CopyTo(block);

            // Try every predictor and keep whichever reconstructs this block most closely.
            var dest = output.AsSpan(b * blockAlign, blockAlign);
            var bestError = long.MaxValue;
            var bestStep = step;
            for (var predictor = 0; predictor < Coefficient1.Length; predictor++)
            {
                var error = EncodeBlock(block, predictor, step, trial, out var endStep);
                if (error < bestError)
                {
                    bestError = error;
                    bestStep = endStep;
                    trial.CopyTo(dest);
                }
            }

            // Start the next block from where this one's step size ended up.
            step = bestStep;
        }

        return output;
    }

    private static long EncodeBlock(short[] samples, int predictor, int step, byte[] dest, out int endStep)
    {
        int c1 = Coefficient1[predictor], c2 = Coefficient2[predictor];

        // The decoder outputs the second header sample first.
        int previous2 = samples[0], previous1 = samples[1];
        dest[0] = (byte)predictor;
        BinaryPrimitives.WriteInt16LittleEndian(dest.AsSpan(1), (short)step);
        BinaryPrimitives.WriteInt16LittleEndian(dest.AsSpan(3), (short)previous1);
        BinaryPrimitives.WriteInt16LittleEndian(dest.AsSpan(5), (short)previous2);
        Array.Clear(dest, HeaderSize, dest.Length - HeaderSize);

        long error = 0;
        for (var i = 2; i < samples.Length; i++)
        {
            // Truncating division, as in Microsoft's reference decoder.
            var predicted = ((previous1 * c1) + (previous2 * c2)) / 256;
            var difference = samples[i] - predicted;
            var code = (difference + (difference >= 0 ? step / 2 : -step / 2)) / step;
            code = Math.Clamp(code, -8, 7);

            var decoded = Math.Clamp(predicted + (code * step), short.MinValue, short.MaxValue);
            var miss = samples[i] - decoded;
            error += (long)miss * miss;

            previous2 = previous1;
            previous1 = decoded;
            step = Math.Max(MinStep, (Adaptation[code & 0xF] * step) / 256);

            var index = HeaderSize + ((i - 2) / 2);
            if ((i & 1) == 0)
                dest[index] = (byte)((code & 0xF) << 4); // first code of a byte goes in the high nibble
            else
                dest[index] |= (byte)(code & 0xF);
        }

        endStep = step;
        return error;
    }
}
