import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const toEmail = 'desenvolvimentoimoveis@gmail.com'

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await request.json()

    const name = (body?.name || '').toString().trim()
    const phone = (body?.phone || '').toString().trim()
    const description = (body?.description || '').toString().trim()
    const question = (body?.question || '').toString().trim()
    const pageUrl = (body?.page_url || '').toString().trim()

    if (!name || !phone || !description) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const safeName = escapeHtml(name)
    const safePhone = escapeHtml(phone)
    const safeDescription = escapeHtml(description)
    const safeQuestion = escapeHtml(question)
    const safePageUrl = escapeHtml(pageUrl)

    const emailResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: toEmail,
      subject: 'Nova Duvida FAQ',
      html: `
        <h2>Nova dúvida enviada pelo FAQ</h2>
        <p><strong>Nome:</strong> ${safeName}</p>
        <p><strong>Telefone:</strong> ${safePhone}</p>
        <p><strong>Pergunta:</strong> ${safeQuestion || 'N/A'}</p>
        <p><strong>Página:</strong> ${safePageUrl || 'N/A'}</p>
        <p><strong>Descrição:</strong></p>
        <p>${safeDescription.replace(/\\n/g, '<br />')}</p>
      `,
    })

    if (emailResult?.error) {
      return NextResponse.json(
        { error: emailResult.error.message || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}
