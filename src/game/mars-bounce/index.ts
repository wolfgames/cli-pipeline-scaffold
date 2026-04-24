/**
 * Mars Bounce — game entry point.
 *
 * Exports setupGame and setupStartScreen conforming to the mygame-contract.
 * The scaffold's GameScreen.tsx and StartScreen.tsx import from this module.
 */

export { setupGame } from './screens/gameController';
export { setupStartScreen } from './screens/startView';
export type {
  SetupGame,
  SetupStartScreen,
  GameControllerDeps,
  StartScreenDeps,
  GameController,
  StartScreenController,
  GameMode,
} from '~/game/mygame-contract';
