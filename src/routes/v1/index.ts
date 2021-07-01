import app from '../../app'

import authRoute from './auth.route'
import userRoute from './user.route'
import repoRoute from './repo.route'
import shareRoute from './share.route'

function use(route) {
  route.init()
}

const router = {
  init: () => {
    use(authRoute)
    use(repoRoute)
    use(shareRoute)
    use(userRoute)
  },
}

export default router
