import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const invitations = await db.invitation.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(invitations)
  } catch (error: any) {
    console.error('Fetch invitations error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const invitation = await db.invitation.create({
      data: {
        template: body.template,
        lastName: body.lastName,
        firstName: body.firstName,
        sex: body.sex,
        dateOfBirth: body.dateOfBirth,
        nationality: body.nationality,
        passportNumber: body.passportNumber,
        arrivalDate: body.arrivalDate,
        departureDate: body.departureDate,
        visitPurpose: body.visitPurpose,
        cityToVisit: body.cityToVisit,
        inviterRelation: body.inviterRelation,
        fundingSource: body.fundingSource,
        notes: body.notes || null,
      },
    })

    return NextResponse.json(invitation, { status: 201 })
  } catch (error: any) {
    console.error('Create invitation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
