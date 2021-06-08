import express from 'express'

import repoController from '../../controllers/repo.controller'

const router = express.Router()

router
  .route('/add')
  .post(repoController.add)

router
  .route('/remove')
  .post(repoController.remove)

router
  .route('/add-submodules')
  .post(repoController.addSubmodules)

router
  .route('/remove-submodules')
  .post(repoController.removeSubmodules)

export default router
