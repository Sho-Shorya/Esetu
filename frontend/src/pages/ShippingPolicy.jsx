import React from "react";
import {
  ArrowLeft,
  Truck,
  MapPin,
  Clock,
  Mail,
  IndianRupee,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ShippingPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center
                       hover:bg-gray-100 active:scale-95 transition"
            aria-label="Go back"
          >
            <ArrowLeft size={21} />
          </button>

          <div>
            <h1 className="text-lg sm:text-xl font-bold">Shipping Policy</h1>
            <p className="text-xs text-gray-500">e-Setu Policies</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-black text-white">
        <div className="max-w-4xl mx-auto px-5 py-10 sm:py-14">
          <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center mb-5">
            <Truck size={28} />
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Shipping Policy
          </h2>

          <p className="mt-3 text-sm sm:text-base text-gray-300 leading-7 max-w-2xl">
            Information about order shipment, delivery timelines, delivery
            addresses, and shipping charges on e-Setu.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Quick Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <InfoCard
            icon={<Truck size={21} />}
            label="Shipping"
            value="Domestic"
          />

          <InfoCard
            icon={<Clock size={21} />}
            label="Shipment"
            value="Within 12 Days"
          />

          <InfoCard
            icon={<MapPin size={21} />}
            label="Delivery"
            value="Buyer Address"
          />

          <InfoCard
            icon={<IndianRupee size={21} />}
            label="Shipping Cost"
            value="Non-Refundable"
          />
        </div>

        {/* Introduction */}
        <section className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 mb-5">
          <p className="text-gray-600 text-sm sm:text-base leading-7">
            e-Setu ships orders through registered domestic courier companies
            and/or Speed Post, subject to applicable courier and postal service
            norms.
          </p>
        </section>

        <div className="space-y-5">
          {/* 01 */}
          <PolicySection
            number="01"
            icon={<Truck size={20} />}
            title="Shipping & Delivery"
          >
            <p>
              Orders are shipped through{" "}
              <strong>
                registered domestic courier companies and/or Speed Post
              </strong>{" "}
              only.
            </p>

            <p>
              Orders are shipped within{" "}
              <strong>12 days from the date of the order and/or payment</strong>
              , or as per the delivery date agreed at the time of order
              confirmation.
            </p>

            <p>
              Delivery is subject to the applicable norms, procedures, and
              service availability of the courier company or postal authority.
            </p>
          </PolicySection>

          {/* 02 */}
          <PolicySection
            number="02"
            icon={<Clock size={20} />}
            title="Delivery Delays"
          >
            <p>
              While e-Setu makes reasonable efforts to ensure timely delivery,
              the Platform Owner shall not be liable for any delay caused by the
              courier company or postal authority.
            </p>

            <p>
              Delivery timelines may vary depending on the destination, courier
              availability, postal service conditions, weather, operational
              issues, or other circumstances beyond our control.
            </p>
          </PolicySection>

          {/* 03 */}
          <PolicySection
            number="03"
            icon={<MapPin size={20} />}
            title="Delivery Address"
          >
            <p>
              Delivery of all orders will be made to the{" "}
              <strong>
                address provided by the buyer at the time of purchase.
              </strong>
            </p>

            <p>
              Please ensure that the delivery address and contact information
              provided during checkout are accurate and complete.
            </p>
          </PolicySection>

          {/* 04 */}
          <PolicySection
            number="04"
            icon={<Mail size={20} />}
            title="Delivery Confirmation"
          >
            <p>
              Delivery of our services will be confirmed through the{" "}
              <strong>
                email ID specified by you at the time of registration.
              </strong>
            </p>

            <p>
              Please ensure that the registered email address is accurate and
              accessible.
            </p>
          </PolicySection>

          {/* 05 */}
          <PolicySection
            number="05"
            icon={<IndianRupee size={20} />}
            title="Shipping Charges"
          >
            <p>
              If any shipping costs are levied by the seller or the Platform
              Owner, as applicable, the same will be communicated or charged as
              applicable to the order.
            </p>

            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 sm:p-5">
              <p className="font-semibold text-red-700">
                Shipping charges are non-refundable.
              </p>

              <p className="text-red-700 mt-2 text-sm">
                Any shipping cost(s) levied by the seller or Platform Owner, as
                applicable, will not be refundable.
              </p>
            </div>
          </PolicySection>

          {/* 06 */}
          <PolicySection
            number="06"
            icon={<ShieldCheck size={20} />}
            title="Important Notice"
          >
            <p>
              By placing an order through e-Setu, you acknowledge and agree to
              the shipping and delivery terms described in this Shipping Policy.
            </p>

            <p>
              Shipping and delivery may be subject to the operational rules and
              service limitations of the applicable courier company or postal
              authority.
            </p>
          </PolicySection>
        </div>

        {/* Support */}
        <section className="mt-6 bg-black text-white rounded-3xl p-6 sm:p-8">
          <p className="text-red-500 text-xs font-bold uppercase tracking-wider mb-2">
            Need Help?
          </p>

          <h2 className="text-xl sm:text-2xl font-bold">
            Contact e-Setu Support
          </h2>

          <p className="text-gray-400 text-sm leading-6 mt-2">
            If you have questions regarding shipping, delivery, or your order,
            please contact e-Setu customer support.
          </p>

          <a
            href="tel:8397067785"
            className="inline-flex items-center gap-2 mt-5 px-5 py-3
                       rounded-xl bg-red-600 hover:bg-red-700
                       font-semibold text-sm transition active:scale-95"
          >
            <Truck size={17} />
            Call 8397067785
          </a>
        </section>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8 leading-5">
          By using e-Setu, you acknowledge that you have read and understood
          this Shipping Policy.
        </p>
      </main>
    </div>
  );
};

const InfoCard = ({ icon, label, value }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="text-red-600 mb-2">{icon}</div>

      <p className="text-xs text-gray-500">{label}</p>

      <p className="font-bold text-sm mt-1">{value}</p>
    </div>
  );
};

const PolicySection = ({ number, icon, title, children }) => {
  return (
    <section className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8">
      <div className="flex gap-4">
        <div
          className="shrink-0 w-10 h-10 rounded-xl
                     bg-red-50 text-red-600
                     flex items-center justify-center"
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-red-600">{number}</span>

            <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
          </div>

          <div className="space-y-3 text-sm sm:text-base text-gray-600 leading-7">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ShippingPolicy;
