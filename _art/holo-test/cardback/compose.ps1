param([string]$Background = "$PSScriptRoot/generated-background.png")
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Collections.Generic;
public static class CardbackCutout {
    public static Bitmap Extract(Bitmap source) {
        var output = new Bitmap(source);
        var seen = new bool[source.Width * source.Height];
        var queue = new Queue<Point>();
        for (int x = 0; x < source.Width; x++) { queue.Enqueue(new Point(x,0)); queue.Enqueue(new Point(x,source.Height-1)); }
        for (int y = 0; y < source.Height; y++) { queue.Enqueue(new Point(0,y)); queue.Enqueue(new Point(source.Width-1,y)); }
        while (queue.Count > 0) {
            Point p = queue.Dequeue();
            if (p.X < 0 || p.Y < 0 || p.X >= source.Width || p.Y >= source.Height) continue;
            int index = p.Y * source.Width + p.X;
            if (seen[index]) continue;
            seen[index] = true;
            Color c = source.GetPixel(p.X,p.Y);
            if (c.R != 255 || c.G != 255 || c.B != 255) continue;
            output.SetPixel(p.X,p.Y,Color.Transparent);
            queue.Enqueue(new Point(p.X-1,p.Y)); queue.Enqueue(new Point(p.X+1,p.Y));
            queue.Enqueue(new Point(p.X,p.Y-1)); queue.Enqueue(new Point(p.X,p.Y+1));
        }
        return output;
    }
}
'@
$source = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot/subject-hotdog.png")
$cutout = [CardbackCutout]::Extract($source)
$cutout.Save("$PSScriptRoot/subject-cutout.png", [System.Drawing.Imaging.ImageFormat]::Png)
$minX=$source.Width; $minY=$source.Height; $maxX=0; $maxY=0; $retained=0; $changed=0
for($y=0;$y -lt $cutout.Height;$y++) { for($x=0;$x -lt $cutout.Width;$x++) {
    if($cutout.GetPixel($x,$y).A -gt 0) {
        $minX=[Math]::Min($minX,$x); $maxX=[Math]::Max($maxX,$x)
        $minY=[Math]::Min($minY,$y); $maxY=[Math]::Max($maxY,$y)
        $retained++
        if($cutout.GetPixel($x,$y).ToArgb() -ne $source.GetPixel($x,$y).ToArgb()) { $changed++ }
    }
} }
$bg = [System.Drawing.Bitmap]::FromFile($Background)
$canvas = New-Object System.Drawing.Bitmap 1000,1400
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#26324f'))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ratio = [Math]::Min(930.0/$bg.Width,1302.0/$bg.Height)
$width = [single]($bg.Width*$ratio); $height = [single]($bg.Height*$ratio)
$g.DrawImage($bg,[single]((1000-$width)/2),[single]((1400-$height)/2),$width,$height)
$g.Dispose()
$offsetX = [int][Math]::Round(500-($minX+$maxX)/2)
$offsetY = [int][Math]::Round(700-($minY+$maxY)/2)
# Copy original retained pixels at native scale: no redraw, recoloring, or resampling.
for($y=0;$y -lt $cutout.Height;$y++) { for($x=0;$x -lt $cutout.Width;$x++) {
    $pixel=$cutout.GetPixel($x,$y)
    if($pixel.A -gt 0) { $canvas.SetPixel($offsetX+$x,$offsetY+$y,$pixel) }
} }
$canvas.Save("$PSScriptRoot/deluxe-back.png",[System.Drawing.Imaging.ImageFormat]::Png)
$mismatch=0
for($y=0;$y -lt $cutout.Height;$y++) { for($x=0;$x -lt $cutout.Width;$x++) {
    if($cutout.GetPixel($x,$y).A -gt 0 -and $canvas.GetPixel($offsetX+$x,$offsetY+$y).ToArgb() -ne $source.GetPixel($x,$y).ToArgb()) { $mismatch++ }
} }
Write-Output "Output=1000x1400; source=$($source.Width)x$($source.Height); retained=$retained; changed=$changed; composite_mismatch=$mismatch; bbox=$minX,$minY,$maxX,$maxY; offset=$offsetX,$offsetY"
$source.Dispose(); $cutout.Dispose(); $bg.Dispose(); $canvas.Dispose()
if($changed -ne 0 -or $mismatch -ne 0) { throw 'Subject pixel verification failed' }
