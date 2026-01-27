
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const callAIWebhook = async (
  webhookUrl: string,
  message: string,
  history: ChatMessage[]
): Promise<string> => {
  if (!webhookUrl) throw new Error("URL de Webhook no configurada en Ajustes");

  // Enviamos solo el mensaje y el historial para que n8n haga el resto
  const payload = {
    message,
    history,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Error n8n: ${response.status}`);

    const data = await response.json();
    
    // Extraer respuesta del formato que devuelva n8n
    const output = data.output || data.text || data.response || data.message;
    if (output) return output;
    
    if (Array.isArray(data) && data[0] && (data[0].output || data[0].text)) {
      return data[0].output || data[0].text;
    }

    return typeof data === 'string' ? data : "He recibido tu mensaje pero n8n no devolvió un formato de texto claro.";
  } catch (error) {
    console.error("Error de conexión con n8n:", error);
    throw new Error("No pude conectar con tu servidor de IA.");
  }
};
