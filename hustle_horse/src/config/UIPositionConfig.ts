import { Scene } from 'phaser';

export const SPINNER_POS_X_MUL = 0.85;
export const SPINNER_POS_Y_MUL = 0.82;
export const SPINNER_WHEEL_OFFSET_X = 0;
export const SPINNER_WHEEL_OFFSET_Y = -90;

export function getSpinnerPosition(scene: Scene) {
  return {
    x: scene.scale.width * SPINNER_POS_X_MUL,
    y: scene.scale.height * SPINNER_POS_Y_MUL,
  };
}

export const AUTOPLAY_GRID_START_X_CENTER_MUL = 0.5;
export const AUTOPLAY_GRID_START_X_OFFSET_PX = -180;
export const AUTOPLAY_GRID_START_Y_DELTA = 240;
export const AUTOPLAY_BUTTON_WIDTH = 79;
export const AUTOPLAY_BUTTON_HEIGHT = 60;
export const AUTOPLAY_BUTTON_SPACING = 15;
export const AUTOPLAY_CONFIRM_Y_DELTA = 580;

export const BUYFEATURE_CONFIRM_Y_DELTA = 560;
export const BUYFEATURE_PLUS_MINUS_OFFSET = 150;
export const BUYFEATURE_FEATURE_LOGO_Y_DELTA = 210;

// Controller buttons (SlotController) additional offsets applied AFTER base positions
export const TURBO_OFFSET_X = 0;
export const TURBO_OFFSET_Y = 0;

export const AUTOPLAY_OFFSET_X = 0;
export const AUTOPLAY_OFFSET_Y = 0;

export const AMPLIFY_OFFSET_X = 0;
export const AMPLIFY_OFFSET_Y = 0;

export const FEATURE_OFFSET_X = 0;
export const FEATURE_OFFSET_Y = 0;

export const BET_MINUS_OFFSET_X = 0;
export const BET_MINUS_OFFSET_Y = 0;

export const BET_PLUS_OFFSET_X = 0;
export const BET_PLUS_OFFSET_Y = 0;

// Global offsets applied to ALL controller buttons and ALL labels (added on top of individual offsets)
export const CONTROLLER_BUTTON_OFFSET_X = 0;
export const CONTROLLER_BUTTON_OFFSET_Y = 0;
export const CONTROLLER_LABEL_OFFSET_X = 0;
export const CONTROLLER_LABEL_OFFSET_Y = 0;

// Amplify description ("Double Chance" / "For Feature") block offsets
export const AMPLIFY_DESCRIPTION_OFFSET_X = 0;
export const AMPLIFY_DESCRIPTION_OFFSET_Y = 0;

// Controller button label offsets (text labels rendered near buttons)
export const TURBO_LABEL_OFFSET_X = 0;
export const TURBO_LABEL_OFFSET_Y = 90;

export const AUTOPLAY_LABEL_OFFSET_X = 0;
export const AUTOPLAY_LABEL_OFFSET_Y = 90;

export const AMPLIFY_LABEL_OFFSET_X = 0;
export const AMPLIFY_LABEL_OFFSET_Y = 90;

export const MENU_LABEL_OFFSET_X = 0;
export const MENU_LABEL_OFFSET_Y = 85;

// BUY FEATURE label offsets
export const FEATURE_LABEL1_OFFSET_X = 0;
export const FEATURE_LABEL1_OFFSET_Y = 0;

// Base overlay border adjustable offsets (Y)
// Positive upper moves the top border downward (inside the mask)
// Negative lower moves the bottom border upward (inside the mask)
export const BORDER_UPPER_OFFSET_Y = 30;
export const BORDER_LOWER_OFFSET_Y = -30;
