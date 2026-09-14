export function handleFileRead(args: {
  operation: string;
  filePath: string;
}): string {
  const { operation, filePath } = args;
  if (operation === 'read') {
    // 读取文件逻辑
    return 'Reading file at path: ' + filePath;
  } else if (operation === 'write') {
    // 写入文件逻辑
    return 'Writing file at path: ' + filePath;
  } else return 'Unknown operation';
}
