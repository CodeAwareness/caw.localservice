import authRoute from './gardener.auth.route'
import repoRoute from './gardener.repo.route'
import shareRoute from './gardener.share.route'

const router = {
  init: (): void => {
    authRoute.init()
    repoRoute.init()
    shareRoute.init()
  },
}

export default router
