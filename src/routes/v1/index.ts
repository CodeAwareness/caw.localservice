import authRoute from './auth.route'
import repoRoute from './repo.route'
import shareRoute from './share.route'

function use(route) {
  route.init()
}

const router = {
  init: (): void => {
    use(authRoute)
    use(repoRoute)
    use(shareRoute)
  },
}

export default router
