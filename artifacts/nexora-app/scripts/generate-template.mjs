import PizZip from "pizzip";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
          xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
          mc:Ignorable="w14">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
        <w:lang w:val="es-ES" w:eastAsia="es-ES" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr>
      <w:spacing w:after="80" w:line="276" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
</w:styles>`;

const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="708"/>
</w:settings>`;

const WORD_DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            mc:Ignorable="">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="left"/>
        <w:spacing w:before="0" w:after="40"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="32"/>
          <w:szCs w:val="32"/>
          <w:color w:val="1E3A5F"/>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        </w:rPr>
        <w:t>NEXORA CERAMICA S.L  B24881047</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:color w:val="555555"/>
          <w:sz w:val="18"/>
          <w:szCs w:val="18"/>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        </w:rPr>
        <w:t>AVENIDA DEL MEDITERRANEO, 87, NAVE 3, ONDA (CASTELLON), SPAIN</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:color w:val="555555"/>
          <w:sz w:val="18"/>
          <w:szCs w:val="18"/>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        </w:rPr>
        <w:t>info@nexoraceramica.es</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="1" w:color="1E3A5F"/>
        </w:pBdr>
        <w:spacing w:before="80" w:after="160"/>
      </w:pPr>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="80" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="48"/>
          <w:szCs w:val="48"/>
          <w:color w:val="1E3A5F"/>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        </w:rPr>
        <w:t>PACKING LIST</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="1" w:color="1E3A5F"/>
        </w:pBdr>
        <w:spacing w:before="0" w:after="200"/>
      </w:pPr>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="9360" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="0" w:type="dxa"/>
          <w:left w:w="108" w:type="dxa"/>
          <w:bottom w:w="0" w:type="dxa"/>
          <w:right w:w="108" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="2340"/>
        <w:gridCol w:w="2340"/>
        <w:gridCol w:w="2340"/>
        <w:gridCol w:w="2340"/>
      </w:tblGrid>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="1E3A5F"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>NUMERO FACTURA:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>{invoice_reference}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="1E3A5F"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>CLIENTE:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>{client_name}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="1E3A5F"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>FECHA FACTURA:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>{invoice_date}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="1E3A5F"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>VAT:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>{client_vat}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="1E3A5F"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>PROVEEDOR:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>{supplier_name}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="1E3A5F"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>DIRECCION:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2340" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>{client_address}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:pPr><w:spacing w:before="200" w:after="0"/></w:pPr>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9360" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="1E3A5F"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="1E3A5F"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="1E3A5F"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="1E3A5F"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="1E3A5F"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="1E3A5F"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="60" w:type="dxa"/>
          <w:left w:w="108" w:type="dxa"/>
          <w:bottom w:w="60" w:type="dxa"/>
          <w:right w:w="108" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="720"/>
        <w:gridCol w:w="1800"/>
        <w:gridCol w:w="720"/>
        <w:gridCol w:w="620"/>
        <w:gridCol w:w="620"/>
        <w:gridCol w:w="680"/>
        <w:gridCol w:w="680"/>
        <w:gridCol w:w="680"/>
        <w:gridCol w:w="780"/>
        <w:gridCol w:w="780"/>
        <w:gridCol w:w="680"/>
      </w:tblGrid>
      <w:tr>
        <w:trPr>
          <w:trPr>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:trPr>
        </w:trPr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="720" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Articulo</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1800" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Descripcion del Producto</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="720" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Embalaje</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="620" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Piezas</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="620" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Bultos</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="680" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>L(m)</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="680" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>A(m)</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="680" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>H(m)</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="780" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>P.Neto(kg)</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="780" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>P.Bruto(kg)</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="680" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="1E3A5F"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>CBM(m3)</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
      {#items}
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="720" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{article_code}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="1800" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{product_description}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="720" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{packing_type}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="620" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{quantity_pieces}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="620" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{packing_units}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="680" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{dim_length_m}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="680" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{dim_width_m}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="680" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{dim_height_m}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="780" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{net_weight_kg}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="780" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{gross_weight_kg}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="680" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>{cbm}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
      {/items}
    </w:tbl>
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:top w:val="single" w:sz="6" w:space="1" w:color="1E3A5F"/>
        </w:pBdr>
        <w:spacing w:before="200" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:color w:val="1E3A5F"/>
          <w:sz w:val="20"/>
          <w:szCs w:val="20"/>
        </w:rPr>
        <w:t xml:space="preserve">TOTALES:   Bultos: {total_units}   |   P.Neto: {total_net} kg   |   P.Bruto: {total_gross} kg   |   CBM: {total_cbm} m3</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/>
        </w:pBdr>
        <w:spacing w:before="400" w:after="200"/>
      </w:pPr>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:before="80" w:after="0"/></w:pPr>
      <w:r>
        <w:rPr>
          <w:i/>
          <w:color w:val="888888"/>
          <w:sz w:val="16"/>
          <w:szCs w:val="16"/>
        </w:rPr>
        <w:t>Operacion exenta de IVA de conformidad al articulo 21 de la Ley 37/1992 del Impuesto sobre el Valor Anadido.</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const zip = new PizZip();
zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
zip.folder("_rels").file(".rels", ROOT_RELS_XML);
const wordFolder = zip.folder("word");
wordFolder.file("document.xml", WORD_DOCUMENT_XML);
wordFolder.file("styles.xml", STYLES_XML);
wordFolder.file("settings.xml", SETTINGS_XML);
wordFolder.folder("_rels").file("document.xml.rels", WORD_RELS_XML);

const buffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = join(__dirname, "../public/templates/Nexora_Template.docx");
writeFileSync(outPath, buffer);
console.log("Nexora_Template.docx generated at", outPath);
