using System.Runtime.InteropServices;
using System.Windows;

namespace Authenticator;

static class ClipboardHelper
{
    /// <summary>
    /// Copies text, retrying while another app holds the clipboard. Sensitive text (setup keys) is kept out of
    /// Windows clipboard history and cloud clipboard.
    /// </summary>
    public static bool SetText(string text, bool sensitive = false)
    {
        var data = new DataObject();
        data.SetText(text, TextDataFormat.UnicodeText);
        if (sensitive)
        {
            data.SetData("CanIncludeInClipboardHistory", new MemoryStream(BitConverter.GetBytes(0)));
            data.SetData("CanUploadToCloudClipboard", new MemoryStream(BitConverter.GetBytes(0)));
            data.SetData("ExcludeClipboardContentFromMonitorProcessing", new MemoryStream(BitConverter.GetBytes(0)));
        }
        for (int attempt = 0; attempt < 6; attempt++)
        {
            try
            {
                Clipboard.SetDataObject(data, copy: true);
                return true;
            }
            catch (COMException)
            {
                Thread.Sleep(40);
            }
        }
        return false;
    }
}
