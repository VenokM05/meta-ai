/**
 * The camera window is portrait. Every frame sent to the model is this same centred crop,
 * so a box or mask comes back in the coordinates of the pixels the user is shown.
 *
 * Camera constraints are hints: a phone that only offers 16:9 will ignore a 9:16 request.
 * Cropping here is what makes the window shape independent of what the sensor delivers.
 */
export const FRAME_ASPECT = 9 / 16;

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Largest centred rectangle of `aspect` that fits inside a width x height frame. */
export function centerCrop(width: number, height: number, aspect = FRAME_ASPECT): CropRect {
  if (!(width > 0) || !(height > 0)) return { sx: 0, sy: 0, sw: 0, sh: 0 };
  if (width / height > aspect) {
    const sw = height * aspect;
    return { sx: (width - sw) / 2, sy: 0, sw, sh: height };
  }
  const sh = width / aspect;
  return { sx: 0, sy: (height - sh) / 2, sw: width, sh };
}
