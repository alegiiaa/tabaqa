import { Hero } from './components/Hero'
import { ProductMock } from './components/ProductMock'
import { Features } from './components/Features'
import { HowItWorks } from './components/HowItWorks'
import { Security } from './components/Security'
import { ApiSection } from './components/ApiSection'
import { Faq } from './components/Faq'
import { SignUp } from './components/SignUp'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <>
      <Hero />
      <ProductMock />
      <div className="soft-line" />
      <Features />
      <HowItWorks />
      <Security />
      <ApiSection />
      <Faq />
      <SignUp />
      <Footer />
    </>
  )
}
