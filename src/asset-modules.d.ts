// Bun import attributes: `with { type: 'text' }` yields a string, `with { type: 'file' }` a file path
declare module '*.css' { const value: string; export default value }
declare module '*.webp' { const value: string; export default value }
declare module '*.txt' { const value: string; export default value }
