import type { ArtProps } from "./AsciiBackdrop";

/** One ASCII art piece inside <AsciiBackdrop>. Renders nothing itself: the backdrop
 *  reads these props and draws the art in its shader. */
export default function AsciiArt(props: ArtProps): null {
  void props;
  return null;
}
AsciiArt.asciiArt = true;
