import { ChatPanel } from './ui/ChatPanel.tsx'
import { CodeEditor } from './ui/CodeEditor.tsx'
import { DiffPanel } from './ui/DiffPanel.tsx'
import { FileList } from './ui/FileList.tsx'
import { LlmSettings } from './ui/LlmSettings.tsx'
import { McpPanel } from './ui/McpPanel.tsx'
import { QuestionModal } from './ui/QuestionModal.tsx'
import { TodoList } from './ui/TodoList.tsx'

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      <div className="flex w-52 shrink-0 flex-col overflow-y-auto">
        <FileList />
        <TodoList />
        <LlmSettings />
        <McpPanel />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <CodeEditor />
        </div>
        <DiffPanel />
      </div>
      <div className="w-[min(420px,40vw)] shrink-0">
        <ChatPanel />
      </div>
      <QuestionModal />
    </div>
  )
}

export default App
