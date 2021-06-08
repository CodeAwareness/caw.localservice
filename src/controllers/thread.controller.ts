import catchAsync from '../utils/catchAsync'

const getThreads: any = catchAsync(async (req, res) => {
  console.log('getThreads') // TODO
})

const comment: any = catchAsync(async (req, res) => {
  console.log('comment') // TODO
})

const threadController = {
  comment,
  getThreads,
}

export default threadController
