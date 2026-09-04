const BUSINESS_WHATSAPP = "966557807130";

const form = document.querySelector("#bookingForm");
const packageInputs = document.querySelectorAll('input[name="package"]');
const summaryPackage = document.querySelector("#summaryPackage");
const summaryPrice = document.querySelector("#summaryPrice");
const totalPrice = document.querySelector("#totalPrice");
const dateInput = document.querySelector("#date");
const locationInput = document.querySelector("#location");
const locationStatus = document.querySelector("#locationStatus");
const toast = document.querySelector("#toast");
let mapLink = "";
let bookingMap;
let locationMarker;

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
dateInput.min = localToday;

function updateSummary(input) {
  const price = input.dataset.price;
  summaryPackage.textContent = input.value;
  summaryPrice.textContent = `${price} ر.س`;
  totalPrice.innerHTML = `${price} <small>ر.س</small>`;
}

packageInputs.forEach((input) => input.addEventListener("change", () => updateSummary(input)));

function chooseMapLocation(latitude, longitude, zoom = 16) {
  mapLink = `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  locationInput.value = `الموقع المحدد (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
  if (locationMarker) locationMarker.setLatLng([latitude, longitude]);
  else locationMarker = L.marker([latitude, longitude]).addTo(bookingMap);
  locationMarker.bindPopup("موقع خدمة الغسيل").openPopup();
  bookingMap.setView([latitude, longitude], zoom);
  locationStatus.textContent = "✓ تم حفظ الموقع المحدد وإضافته للحجز.";
}

function initializeMap() {
  if (typeof L === "undefined") {
    locationStatus.textContent = "تعذر تحميل الخريطة. يمكنك كتابة العنوان يدويًا.";
    return;
  }
  bookingMap = L.map("bookingMap", { scrollWheelZoom: false }).setView([24.7136, 46.6753], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(bookingMap);
  bookingMap.on("click", ({ latlng }) => chooseMapLocation(latlng.lat, latlng.lng));
}

initializeMap();

document.querySelector("#getLocation").addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationStatus.textContent = "المتصفح لا يدعم تحديد الموقع. اكتب الحي أو رابط الموقع يدويًا.";
    return;
  }

  locationStatus.textContent = "جاري تحديد موقعك…";
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (bookingMap) chooseMapLocation(coords.latitude, coords.longitude, 17);
      else {
        mapLink = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
        locationInput.value = "تم تحديد الموقع الحالي";
        locationStatus.textContent = "✓ تم حفظ موقعك وإضافته للحجز.";
      }
    },
    () => {
      locationStatus.textContent = "تعذر الوصول للموقع. اسمح للموقع باستخدام موقعك أو اكتب العنوان يدويًا.";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

function showError(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3500);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    showError("فضلاً أكمل بيانات الحجز المطلوبة.");
    return;
  }

  const data = new FormData(form);
  const chosenPackage = document.querySelector('input[name="package"]:checked');
  const formattedDate = new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date(`${data.get("date")}T12:00:00`));
  const locationText = mapLink || data.get("location");
  const message = [
    "مرحبًا، أرغب في حجز غسيل سيارة 🚙✨",
    "",
    `الاسم: ${data.get("name")}`,
    `رقم الجوال: ${data.get("phone")}`,
    `نوع السيارة: ${data.get("carType")}`,
    `الباقة: ${data.get("package")} — ${chosenPackage.dataset.price} ر.س`,
    `التاريخ: ${formattedDate}`,
    `الوقت: ${data.get("time")}`,
    `الموقع: ${locationText}`,
  ].join("\n");

  window.open(`https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

function registerBookingTool() {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  try {
    void Promise.resolve(context.registerTool({
      name: "prepare_car_wash_booking",
      title: "تجهيز حجز غسيل سيارة",
      description: "يملأ نموذج الحجز المرئي ببيانات العميل والباقة والموعد تمهيدًا لمراجعته وإرساله عبر واتساب.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" }, phone: { type: "string" }, carType: { enum: ["سيدان", "دفع رباعي", "وانيت", "سيارة صغيرة"] },
          package: { enum: ["غسيل خارجي", "غسيل متكامل", "عناية فاخرة"] }, date: { type: "string", format: "date" },
          time: { enum: ["9:00 صباحًا", "11:00 صباحًا", "1:00 ظهرًا", "3:00 عصرًا", "5:00 مساءً", "7:00 مساءً"] }, location: { type: "string" }
        },
        required: ["name", "phone", "carType", "package", "date", "time", "location"], additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== "object" || input.date < localToday) throw new Error("بيانات الحجز أو التاريخ غير صالح.");
        const packageInput = [...packageInputs].find((item) => item.value === input.package);
        if (!packageInput) throw new Error("الباقة غير متاحة.");
        for (const key of ["name", "phone", "carType", "date", "time", "location"]) {
          const field = document.querySelector(`#${key}`);
          if (!field || typeof input[key] !== "string" || !input[key].trim()) throw new Error(`الحقل ${key} غير صالح.`);
          field.value = input[key].trim();
        }
        packageInput.checked = true;
        updateSummary(packageInput);
        mapLink = "";
        document.querySelector("#booking").scrollIntoView({ behavior: "smooth" });
        return { status: "ready_for_review", package: input.package, price: Number(packageInput.dataset.price) };
      }
    })).catch(() => {});
  } catch (_) {}
}

registerBookingTool();
