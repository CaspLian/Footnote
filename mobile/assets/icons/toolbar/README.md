# Native toolbar artwork

The profile, Settings and close images are generated from the **regular** Phosphor vectors in phosphor-react-native 3.0.6: UserCircle, GearSix and X. They are local UIKit toolbar images, rendered as templates so the active theme supplies their tint. The SVGs retain Phosphor's 256 × 256 viewBox and define a 24-point icon; PNGs are emitted at 24, 48 and 72 pixels for 1×, 2× and 3× display density.

The source of this raster artwork is deterministic vector conversion, not image generation. The generator is mobile/scripts/generate-toolbar-icons.cjs. It reads the installed package's regular path definitions, writes the source SVGs, then rasterizes them with sharp. Run it from mobile with Node and a sharp installation available through NODE_PATH. sharp is an offline asset-generation tool only and is not a runtime dependency of the app. Regenerate all scales together after changing the source vectors.

The nine shipping PNGs also carry embedded origin metadata. Regeneration replaces those files, so reapply their source-origin metadata before shipping new artwork.

Phosphor is MIT licensed. The source license from phosphor-react-native is reproduced here:

MIT License

Copyright (c) 2020 Dustin Do

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
