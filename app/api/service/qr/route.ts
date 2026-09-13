import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";

// Ekipman için QR etiketi üretir. QR, servis masasında ilgili ekipmanı açan bağlantıyı içerir.
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const url = new URL(request.url);
    const assetId = (url.searchParams.get("asset") || "").trim();
    if (!assetId) return NextResponse.json({ error: "Ekipman belirtilmedi." }, { status: 400 });

    const asset = await getDb().prepare("SELECT id, asset_code, name FROM assets WHERE id = ? AND organization_id = ?")
      .bind(assetId, context.organization.id).first<{ id: string; asset_code: string; name: string }>();
    if (!asset) return NextResponse.json({ error: "Ekipman bulunamadı." }, { status: 404 });

    const target = `${url.origin}/servis?asset=${encodeURIComponent(asset.id)}&organizationId=${encodeURIComponent(context.organization.id)}`;
    const png = await QRCode.toBuffer(target, { type: "png", width: 480, margin: 2 });

    return new Response(png as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="qr-${asset.asset_code || asset.id}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "QR etiketi oluşturulamadı." }, { status: 400 });
  }
}
