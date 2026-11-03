param([switch]$KeepOpen, [switch]$Desktop, [string]$Executable)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class WageSparkProbe {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int X,Y,R,B; }
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
    [StructLayout(LayoutKind.Sequential)] public struct MonitorInfo { public uint Size; public Rect Monitor, Work; public uint Flags; }
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out Rect r);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int index);
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point p);
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point p);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags,int x,int y,int data,UIntPtr extra);
    [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool GetMonitorInfo(IntPtr h, ref MonitorInfo info);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int width, int height, uint flags);
}
'@
$previousDpi = [WageSparkProbe]::SetThreadDpiAwarenessContext([IntPtr](-4))
$original = [WageSparkProbe+Point]::new()
[void][WageSparkProbe]::GetCursorPos([ref]$original)
$exe = if ($Executable) { (Resolve-Path -LiteralPath $Executable).Path }
    else { Join-Path $PSScriptRoot $(if ($Desktop) { '../../src-tauri/target/release/wagespack.exe' } else { 'target/release/wagespark-window-spike.exe' }) }
$title = if ($Desktop) { 'wagespack' } else { 'WageSpark M0' }
$capturePrefix = if ($Desktop) { 'desktop' } else { 'm0' }
$process = Start-Process -FilePath $exe -PassThru
$backdrop = $null
function Move-Cursor($x, $y) { [void][WageSparkProbe]::SetCursorPos($x, $y); Start-Sleep -Milliseconds 90 }
function Mouse($flags) { [WageSparkProbe]::mouse_event($flags,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 90 }
function Save-ProbeCapture($left, $top, $width, $height, $name) {
    $capture = [Drawing.Bitmap]::new($width,$height)
    $graphics = [Drawing.Graphics]::FromImage($capture)
    try {
        $graphics.CopyFromScreen($left,$top,0,0,$capture.Size)
        $path = Join-Path $PSScriptRoot '../../artifacts'
        New-Item -ItemType Directory -Force $path | Out-Null
        $capture.Save((Join-Path $path $name),[Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $capture.Dispose() }
}
try {
    $pet = [IntPtr]::Zero
    for ($i=0; $i -lt 40 -and $pet -eq [IntPtr]::Zero; $i++) {
        Start-Sleep -Milliseconds 250
        if ($process.HasExited) { throw "Probe exited with $($process.ExitCode)" }
        $pet = [WageSparkProbe]::FindWindow([NullString]::Value, "$title Pet")
    }
    if ($pet -eq [IntPtr]::Zero) { throw 'Pet HWND unavailable' }
    Start-Sleep -Milliseconds 1200
    $panel = [WageSparkProbe]::FindWindow([NullString]::Value, "$title Panel")
    if ($panel -eq [IntPtr]::Zero -or [WageSparkProbe]::IsWindowVisible($panel)) { throw 'Panel must exist and start hidden' }
    if (([WageSparkProbe]::GetWindowLong($pet,-20) -band 8) -eq 0) { throw 'Pet must be topmost' }
    "Window style 0x{0:X8}; inspect capture for visible frame" -f [WageSparkProbe]::GetWindowLong($pet,-16)
    $rect = [WageSparkProbe+Rect]::new()
    [void][WageSparkProbe]::GetWindowRect($pet,[ref]$rect)
    $backdrop = [Windows.Forms.Form]::new()
    $backdrop.FormBorderStyle = 'None'
    $backdrop.StartPosition = 'Manual'
    $backdrop.ShowInTaskbar = $false
    $backdrop.BackColor = [Drawing.Color]::FromArgb(214, 221, 219)
    $backdrop.Show()
    $monitor = [WageSparkProbe+MonitorInfo]::new()
    $monitor.Size = 40
    $monitorHandle = [WageSparkProbe]::MonitorFromWindow($pet, 2)
    if (![WageSparkProbe]::GetMonitorInfo($monitorHandle, [ref]$monitor)) { throw 'Monitor work area unavailable' }
    $work = $monitor.Work
    if (![WageSparkProbe]::SetWindowPos($backdrop.Handle,[IntPtr]::Zero,$work.X,$work.Y,($work.R-$work.X),($work.B-$work.Y),0x14)) { throw 'Backdrop positioning failed' }
    [Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 300
    $point = [WageSparkProbe+Point]::new()
    $point.X = $rect.X + 3; $point.Y = $rect.Y + 3
    $target = [WageSparkProbe]::GetAncestor([WageSparkProbe]::WindowFromPoint($point), 2)
    "DPI $([WageSparkProbe]::GetDpiForWindow($pet)); transparent corner targets pet: $($target -eq $pet)"
    $width = $rect.R - $rect.X
    $height = $rect.B - $rect.Y
    Save-ProbeCapture $rect.X $rect.Y $width $height "$capturePrefix-pet.png"
    $photo = [Drawing.Bitmap]::new((Join-Path $PSScriptRoot "../../artifacts/$capturePrefix-pet.png"))
    try {
        $corner = $photo.GetPixel(5,5)
        $delta = [Math]::Abs($corner.R - 214) + [Math]::Abs($corner.G - 221) + [Math]::Abs($corner.B - 219)
        if ($delta -gt 14) { throw "Corner does not show the neutral backdrop: $corner" }
        $center = $photo.GetPixel([int]($width/2),[int]($height/2))
        if ($center.ToArgb() -eq $corner.ToArgb()) { throw 'Character center did not render' }
        $rightEdge = $photo.GetPixel($width - 4,[int]($height/2))
        if ($rightEdge.ToArgb() -ne $corner.ToArgb()) { throw 'Unexpected border or scrollbar on the right edge' }
    } finally { $photo.Dispose() }
    $x = $rect.X + [int]($width/2)
    $y = $rect.Y + [int]($height/2)
    Move-Cursor $x $y
    Mouse 2; Mouse 4
    Start-Sleep -Milliseconds 450
    if (![WageSparkProbe]::IsWindowVisible($panel)) { throw 'Click did not open panel' }
    $panelRect = [WageSparkProbe+Rect]::new()
    [void][WageSparkProbe]::GetWindowRect($panel,[ref]$panelRect)
    $left = [Math]::Min($rect.X,$panelRect.X)
    $top = [Math]::Min($rect.Y,$panelRect.Y)
    Save-ProbeCapture $left $top ([Math]::Max($rect.R,$panelRect.R)-$left) ([Math]::Max($rect.B,$panelRect.B)-$top) "$capturePrefix-panel.png"
    if ($Desktop) {
        $photo = [Drawing.Bitmap]::new((Join-Path $PSScriptRoot "../../artifacts/$capturePrefix-panel.png"))
        try {
            $bubblePixels = 0
            $scale = [WageSparkProbe]::GetDpiForWindow($pet) / 96
            for ($ySample = [int](9*$scale); $ySample -lt [int](24*$scale); $ySample += 2) {
                for ($xSample = [int]($width*.25); $xSample -lt [int]($width*.75); $xSample += 2) {
                    $pixel = $photo.GetPixel($rect.X-$left+$xSample, $rect.Y-$top+$ySample)
                    if ($pixel.R -eq 24 -and $pixel.G -eq 42 -and $pixel.B -eq 34) { $bubblePixels++ }
                }
            }
            if ($bubblePixels -lt 20) { throw 'Dialogue bubble is missing or clipped in the desktop viewport' }
            'PASS: dialogue bubble visible in the desktop viewport'
        } finally { $photo.Dispose() }
    }
    [WageSparkProbe]::keybd_event(27,0,0,[UIntPtr]::Zero)
    [WageSparkProbe]::keybd_event(27,0,2,[UIntPtr]::Zero)
    Start-Sleep -Milliseconds 350
    if ([WageSparkProbe]::IsWindowVisible($panel)) { throw 'Escape did not hide panel' }
    if ($Desktop) {
        Move-Cursor $x $y
        Mouse 8; Mouse 16
        Start-Sleep -Milliseconds 300
        $menu = [WageSparkProbe]::FindWindow('#32768', [NullString]::Value)
        if ($menu -eq [IntPtr]::Zero -or ![WageSparkProbe]::IsWindowVisible($menu)) { throw 'Right click did not open the native menu' }
        [WageSparkProbe]::keybd_event(27,0,0,[UIntPtr]::Zero)
        [WageSparkProbe]::keybd_event(27,0,2,[UIntPtr]::Zero)
        Start-Sleep -Milliseconds 250
        'PASS: native right-click menu opened'
    }
    Move-Cursor $x $y
    Mouse 2
    $dx = if ($Desktop -and $rect.X -gt 120) { -1 } else { 1 }
    $dy = if ($Desktop -and $rect.Y -gt 120) { -1 } else { 1 }
    Move-Cursor ($x+12*$dx) ($y+12*$dy)
    Move-Cursor ($x+80*$dx) ($y+45*$dy)
    Mouse 4
    $after = [WageSparkProbe+Rect]::new()
    [void][WageSparkProbe]::GetWindowRect($pet,[ref]$after)
    if ($after.X -eq $rect.X -and $after.Y -eq $rect.Y) { throw 'Drag did not move pet' }
    if ([WageSparkProbe]::IsWindowVisible($panel)) { throw 'Drag opened panel' }
    'PASS: backdrop visible through transparent corner, character rendered, topmost, hidden panel, click, Escape and drag'
    if ($Desktop) {
        Stop-Process -Id $process.Id
        $process.WaitForExit()
        $process = Start-Process -FilePath $exe -PassThru
        for ($i=0; $i -lt 40; $i++) {
            Start-Sleep -Milliseconds 250
            if ($process.HasExited) { throw "Desktop exited with $($process.ExitCode)" }
            $restored = [WageSparkProbe]::FindWindow([NullString]::Value, "$title Pet")
            if ($restored -ne [IntPtr]::Zero -and [WageSparkProbe]::IsWindowVisible($restored)) { break }
        }
        $restoredRect = [WageSparkProbe+Rect]::new()
        if (![WageSparkProbe]::GetWindowRect($restored,[ref]$restoredRect)) { throw 'Restored pet unavailable' }
        if ($restoredRect.X -ne $after.X -or $restoredRect.Y -ne $after.Y) {
            throw "Restart position $($restoredRect.X),$($restoredRect.Y) differs from $($after.X),$($after.Y)"
        }
        'PASS: desktop position restored after restart'
    }
} finally {
    if ($null -ne $backdrop) { $backdrop.Dispose() }
    [void][WageSparkProbe]::SetCursorPos($original.X,$original.Y)
    [void][WageSparkProbe]::SetThreadDpiAwarenessContext($previousDpi)
    if (!$KeepOpen -and !$process.HasExited) { Stop-Process -Id $process.Id }
}
