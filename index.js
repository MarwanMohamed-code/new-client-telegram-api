// =======================================================
// 1. إعدادات Telegram API - سيتم جلبها من البيئة
// =======================================================
// Deno Deploy سيقرأ هذه المتغيرات من الإعدادات
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") || "BOT_TOKEN_REQUIRED";
const CHAT_ID = Deno.env.get("CHAT_ID") || "CHAT_ID_REQUIRED";
// =======================================================

// مسار الـ API لإرسال المستندات
const TELEGRAM_UPLOAD_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;

// نقطة دخول السيرفر
Deno.serve(async (req) => {
    // تفعيل CORS لتمكين الاتصال من أي موقع
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ success: false, message: 'Only POST method is allowed.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (BOT_TOKEN === "BOT_TOKEN_REQUIRED") {
        return new Response(
            JSON.stringify({ success: false, message: "Server Error: BOT_TOKEN is not configured." }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || typeof file === 'string') {
            return new Response(
                JSON.stringify({ success: false, message: "No file part in the request (Field name must be 'file')." }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const telegramFormData = new FormData();
        telegramFormData.append('chat_id', CHAT_ID);
        telegramFormData.append('caption', `Uploaded via Web App: ${file.name}`);
        telegramFormData.append('document', file, file.name); 

        const telegramResponse = await fetch(TELEGRAM_UPLOAD_URL, {
            method: 'POST',
            body: telegramFormData,
        });

        if (!telegramResponse.ok) {
            const errorText = await telegramResponse.text();
            throw new Error(`Telegram API Upload Failed: ${telegramResponse.status} - ${errorText}`);
        }

        const data = await telegramResponse.json();

        if (data.ok) {
            const documentInfo = data.result.document || data.result.photo.pop();
            const fileId = documentInfo.file_id;
            
            const getFileUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`;
            const fileResponse = await fetch(getFileUrl);
            const fileData = await fileResponse.json();

            if (fileData.ok) {
                const filePath = fileData.result.file_path;
                const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

                return new Response(
                    JSON.stringify({
                        success: true,
                        url: downloadUrl,
                        message: "File uploaded and temporary URL generated."
                    }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            } else {
                throw new Error("Failed to get file path from Telegram.");
            }
        } else {
            throw new Error(`Telegram API Error: ${data.description || 'Unknown error'}`);
        }

    } catch (e) {
        console.error(e);
        return new Response(
            JSON.stringify({ success: false, message: e.message || "An unexpected server error occurred." }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
