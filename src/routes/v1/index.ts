import authRoute from './auth.route'
import repoRoute from './repo.route'
import shareRoute from './share.route'

const router = {
  init: (): void => {
    authRoute.init()
    repoRoute.init()
    shareRoute.init()
  },
}

export default router
