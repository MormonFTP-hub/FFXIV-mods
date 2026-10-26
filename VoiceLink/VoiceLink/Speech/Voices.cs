using System.Linq;

namespace VoiceLink.Speech;

public static class Voices
{
    public const string Default = "en-US-AvaMultilingualNeural";

    /// <summary>Natural voices offered in the settings. Female first; the male ones are there for telling paired friends apart.</summary>
    public static readonly (string Id, string Label)[] Natural =
    [
        ("en-US-AvaMultilingualNeural", "Ava (US)"),
        ("en-US-EmmaMultilingualNeural", "Emma (US)"),
        ("en-US-JennyNeural", "Jenny (US)"),
        ("en-US-AriaNeural", "Aria (US)"),
        ("en-US-MichelleNeural", "Michelle (US)"),
        ("en-GB-SoniaNeural", "Sonia (UK)"),
        ("en-GB-LibbyNeural", "Libby (UK)"),
        ("en-AU-NatashaNeural", "Natasha (Australia)"),
        ("en-IE-EmilyNeural", "Emily (Ireland)"),
        ("en-CA-ClaraNeural", "Clara (Canada)"),
        ("ja-JP-NanamiNeural", "Nanami (Japanese)"),
        ("en-US-AndrewMultilingualNeural", "Andrew (US, male)"),
        ("en-US-BrianMultilingualNeural", "Brian (US, male)"),
        ("en-GB-RyanNeural", "Ryan (UK, male)"),
    ];

    public static string Label(string id) =>
        Natural.FirstOrDefault(v => v.Id == id).Label ?? id;
}
