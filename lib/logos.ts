// lib/logos.ts
export type BrandFolder = "beneficios" | "financas" | "geral" | "seguros";
export type LogoVariant = "white" | "black" | "white_color" | "black_color";
export type LogoLockup = "horizontal" | "stacked";

export type LogoAsset = {
  brand: BrandFolder;
  variant: LogoVariant;
  lockup: LogoLockup;
  path: string; // /logos/<brand>/<filename>
  filename: string;
};

const LOGO_FILES: Record<BrandFolder, string[]> = {
  beneficios: [
    "logo_beneficios_branco_e_salmao_baixo.png",
    "logo_beneficios_branco_lado.png",
    "logo_beneficios_preto_baixo.png",
    "logo_beneficios_preto_e_salmao_lado.png",
    "logo_beneficios_preto_lado.png",
  ],
  financas: [
    "logo_financas_azul_e_branco_baixo.png",
    "logo_financas_azul_e_branco_lado.png",
    "logo_financas_azul_e_preto_lado.png",
    "logo_financas_branco_baixo.png",
    "logo_financas_preto_lado.png",
  ],
  geral: [
    "logo_geral_branco_lado.png",
    "logo_geral_preto_lado.png",
  ],
  seguros: [
    "logo_seguro_branco_e_amarelo_baixo.png",
    "logo_seguros_branco_baixo.png",
    "logo_seguros_branco_e_amarelo_lado.png",
    "logo_seguros_branco_lado.png",
    "logo_seguros_preto_lado.png",
    "logo_seguros_preto_baixo.png",
    "logo_seguros_preto_e_amarelo_baixo.png",
    "logo_seguros_preto_e_amarelo_lado.png",
  ],
};

function includesAny(text: string, tokens: string[]) {
  return tokens.some((t) => text.includes(t));
}

/**
 * Converte o nome do arquivo em:
 * - variant: white / black / white_color / black_color
 * - lockup: horizontal / stacked
 */
export function parseLogoFilename(brand: BrandFolder, filename: string): LogoAsset | null {
  const lower = filename.toLowerCase();

  // lockup
  let lockup: LogoLockup | null = null;
  if (lower.includes("_lado")) lockup = "horizontal";
  else if (lower.includes("_baixo")) lockup = "stacked";
  if (!lockup) return null;

  // branco/preto
  const hasWhite = includesAny(lower, ["branco", "branca"]); // cobre variações
  const hasBlack = includesAny(lower, ["preto", "preta"]);

  // cor de destaque
  const hasAccent = includesAny(lower, ["amarelo", "amarela", "salmao", "coral", "azul"]);

  let variant: LogoVariant | null = null;

  if (hasWhite && hasAccent) variant = "white_color";
  else if (hasBlack && hasAccent) variant = "black_color";
  else if (hasWhite) variant = "white";
  else if (hasBlack) variant = "black";

  // fallback: se tiver cor mas não tiver branco/preto explícito
  if (!variant && hasAccent) variant = "black_color";

  if (!variant) return null;

  return {
    brand,
    variant,
    lockup,
    filename,
    path: `/logos/${brand}/${filename}`,
  };
}

export function buildLogoCatalog(): LogoAsset[] {
  const catalog: LogoAsset[] = [];
  for (const brand of Object.keys(LOGO_FILES) as BrandFolder[]) {
    for (const filename of LOGO_FILES[brand]) {
      const asset = parseLogoFilename(brand, filename);
      if (asset) catalog.push(asset);
    }
  }
  return catalog;
}

/**
 * Seleciona a melhor logo baseada em:
 * - brand folder
 * - background (light/dark/photo)
 * - format
 * - preferColor (usar versões com cor de destaque quando disponível)
 */
export function pickLogo({
  brand,
  background,
  format,
  preferColor = true,
}: {
  brand: BrandFolder;
  background: "light" | "dark" | "photo";
  format:
    | "instagram_feed"
    | "instagram_story"
    | "whatsapp_square"
    | "linkedin_landscape"
    | "linkedin_square";
  preferColor?: boolean;
}): LogoAsset | null {
  const catalog = buildLogoCatalog().filter((l) => l.brand === brand);

  // foto normalmente tem topo variável → usar white como padrão
  const isDark = background === "dark" || background === "photo";

  const wantedVariantOrder: LogoVariant[] = isDark
    ? preferColor
      ? ["white_color", "white", "black_color", "black"]
      : ["white", "white_color", "black", "black_color"]
    : preferColor
      ? ["black_color", "black", "white_color", "white"]
      : ["black", "black_color", "white", "white_color"];

  // Por enquanto: horizontal como padrão seguro.
  // (Quando estiver 100%: feed pode usar stacked quando houver espaço.)
  const wantedLockup: LogoLockup =
    format === "instagram_story" || format === "linkedin_landscape" ? "horizontal" : "horizontal";

  for (const v of wantedVariantOrder) {
    const found = catalog.find((l) => l.variant === v && l.lockup === wantedLockup);
    if (found) return found;
  }

  // fallback: qualquer horizontal
  return catalog.find((l) => l.lockup === "horizontal") || catalog[0] || null;
}
