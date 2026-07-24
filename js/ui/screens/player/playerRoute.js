import { PlayerController } from "../../../core/player/playerController.js";
import { PlayerScreen } from "./playerScreen.js";

// PlayerController binds the shared shell video element. Keeping this side effect
// in the player route removes the complete playback stack from Home startup.
PlayerController.init();

export { PlayerScreen };
