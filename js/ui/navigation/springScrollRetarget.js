export function retargetSpringScrollState(state, currentPosition, nextTarget) {
  if (!state || typeof state !== "object") {
    return state;
  }
  const current = Number.isFinite(Number(currentPosition)) ? Number(currentPosition) : 0;
  const target = Number.isFinite(Number(nextTarget)) ? Number(nextTarget) : current;
  const velocity = Number.isFinite(Number(state.velocity)) ? Number(state.velocity) : 0;
  const nextDirection = Math.sign(target - current);
  const velocityDirection = Math.sign(velocity);

  state.position = current;
  state.target = target;
  if (nextDirection && velocityDirection && nextDirection !== velocityDirection) {
    state.velocity = 0;
  }
  return state;
}
