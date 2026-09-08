export const config = {
  ollama: {
    // Ollama 服务器地址 默认 localhost:11434
    host: 'http://localhost:11434',
    // 聊天模型 默认 qwen3.5:0.8b
    chatModel: 'qwen3.5:0.8b',
    // 向量化模型名称 默认 mxbai-embed-large:latest
    embedModel:'mxbai-embed-large:latest',
    // 生成文本的随机程度，值越大生成的文本越随机，值越小越稳定
    temperature: 0.3,
  }
}