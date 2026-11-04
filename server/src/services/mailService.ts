import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT),
	secure: false,
	auth: {
		user: process.env.SMTP_USERNAME,
		pass: process.env.SMTP_PASSWORD,
	},
});

const DEFAULT_FROM = "Vigie <no-reply@vigie.app>";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_TIMEOUT_MS = 10_000;

// "Nom <adresse>" -> { name, email } ; une adresse seule devient { email }.
function parseSender(from: string): { name?: string; email: string } {
	const match = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
	if (match == null) return { email: from.trim() };
	const name = match[1].replace(/^"|"$/g, "");
	return name ? { name, email: match[2] } : { email: match[2] };
}

// Les hébergeurs comme Railway bloquent le SMTP sortant (ports 25/465/587) :
// en production, l'envoi passe par l'API HTTPS de Brevo (port 443).
async function sendWithBrevoApi(
	apiKey: string,
	{ to, subject, html }: { to: string; subject: string; html: string },
) {
	const res = await fetch(BREVO_API_URL, {
		method: "POST",
		headers: {
			"api-key": apiKey,
			"content-type": "application/json",
			accept: "application/json",
		},
		body: JSON.stringify({
			sender: parseSender(process.env.SMTP_FROM ?? DEFAULT_FROM),
			to: [{ email: to }],
			subject,
			htmlContent: html,
		}),
		signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
	});

	if (!res.ok) {
		throw new Error(`Brevo API ${res.status}: ${await res.text()}`);
	}
	return null;
}

async function send({
	to,
	subject,
	html,
}: {
	to: string;
	subject: string;
	html: string;
}) {
	const brevoApiKey = process.env.BREVO_API_KEY;
	if (brevoApiKey) {
		return sendWithBrevoApi(brevoApiKey, { to, subject, html });
	}

	const info = await transporter.sendMail({
		from: process.env.SMTP_FROM ?? DEFAULT_FROM,
		to,
		subject,
		html,
	});

	// En dev (Ethereal), donne un lien de prévisualisation direct de l'e-mail envoyé.
	// En prod (vrai SMTP), renvoie false — pas de prévisualisation, l'e-mail part réellement.
	return nodemailer.getTestMessageUrl(info) || null;
}

export default { send };
