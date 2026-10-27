// Ratios use the unrotated CropBox, with a top-left origin. PDF.js displays rotation.
export function anchorToDisplay(
  x: number,
  y: number,
  rotation: number,
): [number, number] {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return [1 - y, x];
    case 180:
      return [1 - x, 1 - y];
    case 270:
      return [y, 1 - x];
    default:
      return [x, y];
  }
}
export function displayToAnchor(
  x: number,
  y: number,
  rotation: number,
): [number, number] {
  return anchorToDisplay(x, y, 360 - rotation);
}
