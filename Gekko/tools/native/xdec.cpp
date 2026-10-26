// Tiny C ABI over the basis_universal KTX2 transcoder and the meshoptimizer decoders,
// loaded from Python with ctypes (tools/xdec.py). Build: tools/native/build.ps1
#include <cstdint>
#include <cstring>
#include <vector>
#include "basisu_transcoder.h"
#include "meshoptimizer.h"

#define API extern "C" __declspec(dllexport)

static bool g_init = false;

// Returns 0 on success. Call with out == nullptr to get the size of level 0, then again with a w*h*4 buffer.
API int ktx2_rgba(const uint8_t* data, uint32_t size, uint32_t* w, uint32_t* h, uint8_t* out)
{
    if (!g_init) { basist::basisu_transcoder_init(); g_init = true; }
    basist::ktx2_transcoder t;
    if (!t.init(data, size)) return 1;
    *w = t.get_width(); *h = t.get_height();
    if (!out) return 0;
    if (!t.start_transcoding()) return 2;
    uint32_t layers = t.get_layers() ? t.get_layers() : 1;
    (void)layers;
    if (!t.transcode_image_level(0, 0, 0, out, (*w) * (*h), basist::transcoder_texture_format::cTFRGBA32))
        return 3;
    return 0;
}

API int ktx2_info(const uint8_t* data, uint32_t size, uint32_t* info)
{
    if (!g_init) { basist::basisu_transcoder_init(); g_init = true; }
    basist::ktx2_transcoder t;
    if (!t.init(data, size)) return 1;
    info[0] = t.get_width(); info[1] = t.get_height(); info[2] = t.get_levels();
    info[3] = t.get_layers(); info[4] = t.get_faces(); info[5] = t.is_uastc();
    info[6] = t.get_has_alpha(); info[7] = (uint32_t)t.get_dfd_transfer_func();
    return 0;
}

API int mo_vertex(void* dst, size_t count, size_t stride, const unsigned char* src, size_t size)
{
    return meshopt_decodeVertexBuffer(dst, count, stride, src, size);
}

API int mo_index(void* dst, size_t count, size_t index_size, const unsigned char* src, size_t size)
{
    return meshopt_decodeIndexBuffer(dst, count, index_size, src, size);
}

API int mo_index_seq(void* dst, size_t count, size_t index_size, const unsigned char* src, size_t size)
{
    return meshopt_decodeIndexSequence(dst, count, index_size, src, size);
}

API void mo_filter(int filter, void* buf, size_t count, size_t stride)
{
    if (filter == 1) meshopt_decodeFilterOct(buf, count, stride);
    else if (filter == 2) meshopt_decodeFilterQuat(buf, count, stride);
    else if (filter == 3) meshopt_decodeFilterExp(buf, count, stride);
#ifdef MESHOPT_HAS_COLOR
    else if (filter == 4) meshopt_decodeFilterColor(buf, count, stride);
#endif
}
