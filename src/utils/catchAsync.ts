const catchAsync = (fn: any) => (req: any, res = undefined, next = undefined): Promise<any> => {
  return Promise.resolve(fn(req, res, next)).catch((err) => console.error(err))
}

export default catchAsync
