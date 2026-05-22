import { useRef, useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MarkdownMessage } from "@/components/chat/MarkdownMessage";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Quantos processos ativos temos por coordenação?",
  "Liste as 10 tarefas urgentes em aberto.",
  "Quantas publicações DJEN foram capturadas hoje?",
  "Quais audiências estão marcadas para os próximos 7 dias?",
];

export default function IaResponde() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function enviar(pergunta?: string) {
    const texto = (pergunta ?? input).trim();
    if (!texto || loading) return;
    const next = [...messages, { role: "user" as const, content: texto }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ia-responde", {
        body: { messages: next },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages([...next, { role: "assistant", content: data.answer || "Sem resposta." }]);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao consultar IA");
      setMessages([...next, { role: "assistant", content: `Erro: ${e.message || "falha"}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <MainLayout title="IA Responde" subtitle="Assistente que consulta o sistema para responder suas perguntas">
      <div className="flex flex-col h-[calc(100vh-2rem)] max-w-5xl mx-auto p-4 gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold">IA Responde</h1>
              <p className="text-xs text-muted-foreground">
                Pergunte qualquer coisa sobre o sistema — a IA consulta o banco e responde.
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setMessages([])}>
              <Trash2 className="w-4 h-4 mr-2" /> Nova conversa
            </Button>
          )}
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                <Bot className="w-12 h-12 text-muted-foreground" />
                <div>
                  <p className="font-medium">Como posso ajudar?</p>
                  <p className="text-sm text-muted-foreground">Experimente uma das sugestões abaixo.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl w-full mt-2">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      onClick={() => enviar(s)}
                      className="text-left text-sm p-3 rounded-lg border border-border hover:border-primary hover:bg-accent transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                    {m.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-lg px-4 py-2",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground max-w-[80%]"
                          : "bg-muted max-w-[90%] w-full"
                      )}
                    >
                      {m.role === "assistant" ? (
                        <MarkdownMessage content={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                    {m.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="border-t border-border p-3 flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo sobre o sistema..."
              className="min-h-[44px] max-h-32 resize-none"
              disabled={loading}
            />
            <Button onClick={() => enviar()} disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}