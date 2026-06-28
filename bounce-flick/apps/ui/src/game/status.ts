import type { Phase } from './types'

export const getStatusText = (phase: Phase) => {
  if (phase === 'cleared') {
    return 'Finish reached'
  }

  if (phase === 'crashed') {
    return 'Ball lost'
  }

  return 'Rolling'
}
