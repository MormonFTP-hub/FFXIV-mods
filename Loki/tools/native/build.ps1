# Builds tools/native/xdec.dll (KTX2/UASTC transcoder + meshopt decoders) with the ziglang pip package.
# Sources: apps/src/basis_universal and apps/src/meshoptimizer (shallow git clones).

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$S = Join-Path $root 'apps\src'
$N = $PSScriptRoot
$T = 'x86_64-windows-gnu'
python -m ziglang cc -O2 -c -target $T "$S\basis_universal\zstd\zstddeclib.c" -o "$N\zstddeclib.o"
python -m ziglang c++ -O2 -shared -std=c++17 -target $T `
    -DBASISD_SUPPORT_KTX2=1 -DBASISD_SUPPORT_KTX2_ZSTD=1 -DMESHOPT_HAS_COLOR `
    -I"$S\basis_universal\transcoder" -I"$S\basis_universal\zstd" -I"$S\meshoptimizer\src" `
    "$N\xdec.cpp" "$S\basis_universal\transcoder\basisu_transcoder.cpp" `
    "$S\meshoptimizer\src\vertexcodec.cpp" "$S\meshoptimizer\src\indexcodec.cpp" `
    "$S\meshoptimizer\src\vertexfilter.cpp" "$S\meshoptimizer\src\allocator.cpp" `
    "$N\zstddeclib.o" -o "$N\xdec.dll"
