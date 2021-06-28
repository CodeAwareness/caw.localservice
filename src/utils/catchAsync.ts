const catchAsync = (fn: any) => (req: any, res = undefined, next = undefined): Promise<any> => {
  return Promise.resolve(fn(req, res, next)).catch(err => console.error(err.response?.status, err.response?.data, err.status, err.code, err.request?._currentUrl, err.request?._currentRequest?.method))
}

export default catchAsync
