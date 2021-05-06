import qrcode from "qrcode-generator-es6"

export class QRCodeGenerator {

    static generateQRCode(text: string): HTMLImageElement {
        const qr = new qrcode(0, 'H')
        qr.addData(text)
        qr.make()
        const div: HTMLDivElement = document.createElement("div")
        div.innerHTML = qr.createImgTag(4)
        return div.firstChild as HTMLImageElement
    }
}