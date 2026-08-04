// Colours drawn on the (black) watch screen. The board is meant to read as a
// lacquered wooden tray with painted tiles on it, so everything that is not a
// portrait is a warm dark tone and the only bright accents are the gold of the
// exit and of the selected block.
export const COLOR_BACKGROUND = 0x000000;
export const COLOR_TRAY = 0x2a2019;
export const COLOR_BOARD = 0x120d09;
export const COLOR_EXIT = 0xc8a24a;
export const COLOR_SELECTION = 0xffd76a;
export const COLOR_TEXT = 0xf2ece0;
export const COLOR_MUTED = 0x9a8f7f;
export const COLOR_ACCENT = 0xe8cf9a;
export const COLOR_BUTTON = 0x241c16;
export const COLOR_BUTTON_PRESSED = 0x3d3025;

// The tray drawn under the board, and how far it sticks out past the cells.
export const TRAY_MARGIN = 6;
export const TRAY_RADIUS = 14;

// How thick the ring around the selected block is, and how far outside the block
// it sits, so it frames the portrait instead of covering it.
export const SELECTION_WIDTH = 3;
export const SELECTION_MARGIN = 1;

// The dimmed panel a menu is drawn on, over a board that stays visible behind it.
export const PANEL_ALPHA = 225;

// Type scale for the menus, in pixels.
export const TEXT_TITLE = 40;
export const TEXT_ROW = 30;
export const TEXT_SMALL = 24;
export const TEXT_HINT = 22;
export const MENU_BUTTON_HEIGHT = 46;
export const MENU_GAP = 10;

// How long the screen stays lit while the app is open. A puzzle is solved in long
// silences with nothing touching the screen, and the default ten second display
// timeout would black out mid-thought, so the page asks for ten minutes and hands
// the setting back when it closes.
export const BRIGHT_TIME_MS = 600000;
