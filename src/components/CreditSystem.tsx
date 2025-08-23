'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, Star, Gift, Check } from 'lucide-react'
import { pay } from '@base-org/account'
import { useCredits, CREDIT_PACKAGES, CreditPackage } from '@/hooks/useCredits'

const RECIPIENT_ADDRESS = '0x49Ff63dB812179f1d855dBD8d4755AEb470226Dc'

export default function CreditSystem() {
  const { credits, hasCredits, isFreeUser, addCredits } = useCredits()
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null)

  const handlePurchase = async (pkg: CreditPackage) => {
    setIsProcessing(true)
    setSelectedPackage(pkg)

    try {
      const payment = await pay({
        amount: pkg.price.toString(),
        to: RECIPIENT_ADDRESS,
        testnet: false
      })

      if (payment) {
        await addCredits(pkg.credits)
        setSelectedPackage(null)
      }
    } catch (error) {
      console.error('Payment failed:', error)
    } finally {
      setIsProcessing(false)
      setSelectedPackage(null)
    }
  }

  if (hasCredits) {
    return (
      <Card className="w-full modern-card modern-shadow-lg border-0 mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {credits} Credits Available
                </p>
                {isFreeUser && (
                  <p className="text-sm text-gray-600">
                    Free generations remaining
                  </p>
                )}
              </div>
            </div>
            <Badge className="bg-gradient-to-r from-green-400 to-emerald-400 text-white border-0">
              <Gift className="w-3 h-3 mr-1" />
              Ready
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full modern-card-dark modern-shadow-lg border-0 mb-4">
      <CardContent className="p-5">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-red-400 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-semibold text-white text-lg mb-2">
            Out of Credits
          </h3>
          <p className="text-gray-400 text-sm">
            Buy more credits to continue creating cartoons
          </p>
        </div>

        <div className="space-y-3">
          {CREDIT_PACKAGES.map((pkg, index) => (
            <button
              key={index}
              onClick={() => handlePurchase(pkg)}
              disabled={isProcessing}
              className={`w-full p-4 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                selectedPackage === pkg && isProcessing
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white scale-105'
                  : 'bg-slate-700/50 hover:bg-slate-600/50 text-white border border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-lg flex items-center justify-center">
                    <Star className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">{pkg.label}</p>
                    {pkg.savings && (
                      <p className="text-sm text-teal-400">{pkg.savings}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">${pkg.price}</p>
                  <p className="text-xs text-gray-400">USDC</p>
                </div>
              </div>
              {selectedPackage === pkg && isProcessing && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Processing payment...</span>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Powered by Base Pay • Payments in USDC
          </p>
        </div>
      </CardContent>
    </Card>
  )
}