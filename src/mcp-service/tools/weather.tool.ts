export function handleWeatherQuery(args:{location:string;}): string {
  const {location} = args;
  // 查询天气逻辑
  return 'Querying weather for: ' + location;
} 