import asyncio
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
from groq import Groq

from app.db.session import get_db
from app.db.models import Word
from app.auth.security import get_current_user, User
from app.config import settings

router = APIRouter(prefix="/ai", tags=["ai"])

@router.get("/words/{word_id}/explain")
async def explain_word(
    word_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Streams a real-time Markdown explanation (etymology, nuances, mnemonics)
    for a word using Server-Sent Events (SSE).
    """
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    async def event_generator():
        # Check if Groq API Key is configured
        if settings.GROQ_API_KEY:
            try:
                raw_client = Groq(api_key=settings.GROQ_API_KEY)
                prompt = (
                    f"Provide etymology, usage nuances, cultural context, and a mnemonic to memorize "
                    f"the language learning word '{word.spelling}' (translation: '{word.translation}'). "
                    f"Format the output cleanly in Markdown with headings."
                )
                
                # Stream from Groq using llama3-8b-8192 (fast, cheap)
                completion = raw_client.chat.completions.create(
                    model="llama3-8b-8192",
                    messages=[
                        {"role": "system", "content": "You are a helpful language learning assistant. Always return structured Markdown responses."},
                        {"role": "user", "content": prompt}
                    ],
                    stream=True,
                    temperature=0.7
                )
                
                for chunk in completion:
                    # Yield content as SSE token
                    content = chunk.choices[0].delta.content
                    if content:
                        yield f"data: {content}\n\n"
                        # Short yield delay
                        await asyncio.sleep(0.01)
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                # Fallback to mock streaming if API fails
                print(f"Groq streaming failed: {e}. Falling back to mock streaming.")
                
        # Mock streaming mode
        mock_explanation = (
            f"### AI Insights: **{word.spelling}** ({word.translation})\n\n"
            f"📖 **Etymology**: The word `{word.spelling}` traces back to historical linguistic roots. "
            f"Over centuries, it has evolved into the current form used in modern syntax.\n\n"
            f"💡 **Usage & Nuances**: Typically used in active contexts. While translations "
            f"often equate it directly to '{word.translation}', its use carries distinct emotional "
            f"or grammatical weight depending on sentence layout.\n\n"
            f"🎭 **Cultural Context**: Idiomatic usages abound. In native speech, '{word.spelling}' "
            f"is commonly paired in standard phrases and proverbs.\n\n"
            f"🧠 **Mnemonic**: Visualise a connection between the spelling `{word.spelling}` "
            f"and '{word.translation}' to help solidify recall in your long term memory."
        )
        
        # Stream mock explanation chunk by chunk
        # Send word by word or chunk by chunk to simulate real time streaming
        chunks = [mock_explanation[i:i+8] for i in range(0, len(mock_explanation), 8)]
        for chunk in chunks:
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0.05)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
