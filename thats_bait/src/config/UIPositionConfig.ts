import { Scene } from 'phaser';

export const SPINNER_POS_X_MUL = 0.85;
export const SPINNER_POS_Y_MUL = 0.82;
export const SPINNER_WHEEL_OFFSET_X = 0;
export const SPINNER_WHEEL_OFFSET_Y = -90;

// Scatter Anticipation (Sparkler_Reel) default placement and scale
export const SCATTER_ANTICIPATION_POS_X_MUL = 0.78;
export const SCATTER_ANTICIPATION_POS_Y_MUL = 0.49;
export const SCATTER_ANTICIPATION_DEFAULT_SCALE = 0.85;

// Secondary Scatter Anticipation defaults (independent modifiers)
export const SCATTER_ANTICIPATION2_POS_X_MUL = 0.965;
export const SCATTER_ANTICIPATION2_POS_Y_MUL = 0.49;
export const SCATTER_ANTICIPATION2_DEFAULT_SCALE = 0.85;

export const AUTOPLAY_GRID_START_X_CENTER_MUL = 0.5;
export const AUTOPLAY_GRID_START_X_OFFSET_PX = -180;
export const AUTOPLAY_GRID_START_Y_DELTA = 240;
export const AUTOPLAY_BUTTON_WIDTH = 79;
export const AUTOPLAY_BUTTON_HEIGHT = 60;
export const AUTOPLAY_BUTTON_SPACING = 15;
export const AUTOPLAY_CONFIRM_Y_DELTA = 580;

export const AUTOPLAY_AMPLIFY_BET_SCALE_MODIFIER_X = 2.5;
export const AUTOPLAY_AMPLIFY_BET_SCALE_MODIFIER_Y = 1;

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

// Single container-level offset applied to the entire controller UI (buttons + labels)
export const CONTROLLER_CONTAINER_OFFSET_X = 0;
export const CONTROLLER_CONTAINER_OFFSET_Y = -10;

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

// Header winnings display offsets (applies to both base and bonus headers)
export const HEADER_YOUWIN_OFFSET_X = 0;
export const HEADER_YOUWIN_OFFSET_Y = 16;
export const HEADER_AMOUNT_OFFSET_X = 0;
export const HEADER_AMOUNT_OFFSET_Y = 21;

export const WINTRACKER_BASE_OFFSET_X = 0;
export const WINTRACKER_BASE_OFFSET_Y = -55;
export const WINTRACKER_BONUS_OFFSET_X = 0;
export const WINTRACKER_BONUS_OFFSET_Y = 250;

// BUY FEATURE label offsets
export const FEATURE_LABEL1_OFFSET_X = 0;
export const FEATURE_LABEL1_OFFSET_Y = 0;

// Base overlay border adjustable offsets (Y)
// Positive upper moves the top border downward (inside the mask)
// Negative lower moves the bottom border upward (inside the mask)
export const BORDER_UPPER_OFFSET_Y = 30;
export const BORDER_LOWER_OFFSET_Y = -30;
