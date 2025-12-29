import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Send, Bot, User, Loader2, Search, FileText, 
  Plus, Trash2, MessageSquare, Sparkles
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversa = {
  id: string;
  titulo: string | null;
  created_at: string;
};

export default function AssistenteJuridico() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [tipo, setTipo] = useState<"pesquisa" | "geracao">("pesquisa");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Carregar conversas
  useEffect(() => {
    if (user) {
      loadConversas();
    }
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversas = async () => {
    const { data, error } = await supabase
      .from("repositorio_conversas")
      .select("id, titulo, created_at")
      .eq("usuario_id", user?.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Erro ao carregar conversas:", error);
    } else {
      setConversas(data || []);
    }
  };

  const loadConversa = async (id: string) => {
    const { data, error } = await supabase
      .from("repositorio_mensagens")
      .select("role, content")
      .eq("conversa_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar conversa");
      return;
    }

    setMessages((data || []) as Message[]);
    setConversaId(id);
  };

  const startNewConversa = async () => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("repositorio_conversas")
      .insert({ usuario_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar conversa");
      return null;
    }

    setConversas(prev => [data, ...prev]);
    return data.id;
  };

  const deleteConversa = async (id: string) => {
    const { error } = await supabase
      .from("repositorio_conversas")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir conversa");
      return;
    }

    setConversas(prev => prev.filter(c => c.id !== id));
    if (conversaId === id) {
      setConversaId(null);
      setMessages([]);
    }
  };

  const clearAllConversas = async () => {
    if (!user || conversas.length === 0) return;

    const { error } = await supabase
      .from("repositorio_conversas")
      .delete()
      .eq("usuario_id", user.id);

    if (error) {
      toast.error("Erro ao limpar histórico");
      return;
    }

    setConversas([]);
    setConversaId(null);
    setMessages([]);
    toast.success("Histórico limpo com sucesso");
  };

  const handleNewChat = () => {
    setConversaId(null);
    setMessages([]);
    setInput("");
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Criar conversa se não existir
      let currentConversaId = conversaId;
      if (!currentConversaId) {
        currentConversaId = await startNewConversa();
        if (!currentConversaId) {
          throw new Error("Falha ao criar conversa");
        }
        setConversaId(currentConversaId);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/repositorio-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            messages: [...messages, { role: "user", content: userMessage }],
            conversaId: currentConversaId,
            tipo,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao comunicar com o assistente");
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      
      // Recarregar conversas para atualizar título
      loadConversas();

    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
      // Remover mensagem do usuário se houve erro
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sugestoesPesquisa = [
    "Quais modelos de petição inicial temos no repositório?",
    "Buscar jurisprudência sobre danos morais trabalhistas",
    "Quais são os prazos para recurso ordinário?",
  ];

  const sugestoesGeracao = [
    "Gerar uma petição inicial trabalhista para danos morais",
    "Criar um modelo de contestação para ação de cobrança",
    "Elaborar uma procuração ad judicia",
  ];

  return (
    <MainLayout 
      title="Assistente Jurídico IA" 
      subtitle="Pesquise documentos e gere novos com auxílio de IA"
    >
      <div className="flex gap-6 h-[calc(100vh-12rem)]">
        {/* Sidebar - Histórico */}
        <Card className="w-72 flex-shrink-0 hidden lg:flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Conversas</CardTitle>
              <div className="flex gap-1">
                {conversas.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={clearAllConversas}
                    title="Limpar histórico"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={handleNewChat} title="Nova conversa">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-4 pb-4">
              {conversas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma conversa ainda
                </p>
              ) : (
                <div className="space-y-1">
                  {conversas.map((conversa) => (
                    <div
                      key={conversa.id}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                        conversaId === conversa.id 
                          ? "bg-primary/10 text-primary" 
                          : "hover:bg-muted"
                      )}
                      onClick={() => loadConversa(conversa.id)}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate flex-1">
                        {conversa.titulo || "Nova conversa"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversa(conversa.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3 border-b">
            <Tabs value={tipo} onValueChange={(v) => setTipo(v as "pesquisa" | "geracao")}>
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="pesquisa" className="gap-2">
                  <Search className="w-4 h-4" />
                  Pesquisa
                </TabsTrigger>
                <TabsTrigger value="geracao" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Geração
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {tipo === "pesquisa" 
                      ? "Pesquise no Repositório" 
                      : "Gere Documentos com IA"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md">
                    {tipo === "pesquisa"
                      ? "Faça perguntas sobre documentos, jurisprudências e modelos do escritório."
                      : "Solicite a geração de peças processuais, contratos e outros documentos."}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 justify-center">
                    {(tipo === "pesquisa" ? sugestoesPesquisa : sugestoesGeracao).map((sugestao, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setInput(sugestao)}
                      >
                        {sugestao}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex gap-3",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-4 py-3",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <div className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </div>
                      </div>
                      {message.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
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

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    tipo === "pesquisa"
                      ? "Faça uma pergunta sobre os documentos..."
                      : "Descreva o documento que deseja gerar..."
                  }
                  className="min-h-[60px] resize-none"
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleSend} 
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-[60px] w-[60px]"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                O assistente utiliza os documentos do repositório como base de conhecimento.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
