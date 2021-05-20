/* @flow */

const express = require('express')

const repoController = require('@/controllers/repo.controller')

const router: any = express.Router()

router
  .route('add')
  .post(repoController.add)

router
  .route('remove')
  .post(repoController.remove)

router
  .route('add-submodules')
  .post(repoController.addSubmodules)

router
  .route('remove-submodules')
  .post(repoController.removeSubmodules)

router
  .route('/swarm-auth')
  .post(repoController.swarmAuth)

router
  .route('/contrib')
  .get(repoController.getContributors)
  .post(repoController.uploadDiffs)

router
  .route('/diff')
  .get(repoController.getDiffFile)

router
  .route('/commits')
  .post(repoController.postCommitList)

router
  .route('/common-sha')
  .get(repoController.findCommonSHA)

router
  .route('/info')
  .get(repoController.getRepo)

module.exports = router
