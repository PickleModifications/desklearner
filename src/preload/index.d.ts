import type { DeskLearnerApi } from '@shared/types'

declare global {
  interface Window {
    desklearner: DeskLearnerApi
  }
}

export {}
