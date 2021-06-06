import catchAsync from '@/utils/catchAsync'

const getThreads: any = catchAsync(async (req, res) => {
})

const comment: any = catchAsync(async (req, res) => {
})

const threadController = {
  comment,
  getThreads,
}

export default threadController
