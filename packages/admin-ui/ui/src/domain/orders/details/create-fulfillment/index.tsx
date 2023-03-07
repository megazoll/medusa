import {
  AdminPostOrdersOrderClaimsClaimFulfillmentsReq,
  AdminPostOrdersOrderFulfillmentsReq,
  AdminPostOrdersOrderSwapsSwapFulfillmentsReq,
  ClaimOrder,
  Order,
  Swap,
} from "@medusajs/medusa"
import Metadata, {
  MetadataField,
} from "../../../../components/organisms/metadata"
import React, { useState } from "react"
import {
  useAdminCreateFulfillment,
  useAdminFulfillClaim,
  useAdminFulfillSwap,
  useAdminStockLocations,
} from "medusa-react"

import Button from "../../../../components/fundamentals/button"
import CreateFulfillmentItemsTable, {
  getFulfillableQuantity,
} from "./item-table"
import { getErrorMessage } from "../../../../utils/error-messages"
import useNotification from "../../../../hooks/use-notification"
import { FeatureFlagContext } from "../../../../providers/feature-flag-provider"
import FocusModal from "../../../../components/molecules/modal/focus-modal"
import CrossIcon from "../../../../components/fundamentals/icons/cross-icon"
import FeatureToggle from "../../../../components/fundamentals/feature-toggle"
import Select from "../../../../components/molecules/select/next-select/select"
import Switch from "../../../../components/atoms/switch"

type CreateFulfillmentModalProps = {
  handleCancel: () => void
  address?: object
  email?: string
  orderToFulfill: Order | ClaimOrder | Swap
  orderId: string
}

const CreateFulfillmentModal: React.FC<CreateFulfillmentModalProps> = ({
  handleCancel,
  orderToFulfill,
  orderId,
}) => {
  const { isFeatureEnabled } = React.useContext(FeatureFlagContext)
  const [quantities, setQuantities] = useState<Record<string, number>>(
    "object" in orderToFulfill
      ? (orderToFulfill as Order).items.reduce((acc, next) => {
          return {
            ...acc,
            [next.id]: getFulfillableQuantity(next),
          }
        }, {})
      : {}
  )
  const [noNotis, setNoNotis] = useState(false)
  const [errors, setErrors] = useState({})
  const [locationSelectValue, setLocationSelectValue] = useState<{
    value?: string
    label?: string
  }>({})
  const [metadata, setMetadata] = useState<MetadataField[]>([
    { key: "", value: "" },
  ])

  const salesChannelId =
    "object" in orderToFulfill
      ? (orderToFulfill as Order).sales_channel_id
      : (orderToFulfill as ClaimOrder | Swap)?.order?.sales_channel_id

  const filterableFields: { sales_channel_id?: string } = {}
  if (salesChannelId) {
    filterableFields.sales_channel_id = salesChannelId
  }
  const { stock_locations } = useAdminStockLocations(filterableFields)

  const locationOptions = React.useMemo(() => {
    if (!stock_locations) {
      return []
    }
    return stock_locations.map((sl) => ({
      value: sl.id,
      label: sl.name,
    }))
  }, [stock_locations])

  const items =
    "items" in orderToFulfill
      ? orderToFulfill.items
      : orderToFulfill.additional_items

  const createOrderFulfillment = useAdminCreateFulfillment(orderId)
  const createSwapFulfillment = useAdminFulfillSwap(orderId)
  const createClaimFulfillment = useAdminFulfillClaim(orderId)

  const isSubmitting =
    createOrderFulfillment.isLoading ||
    createSwapFulfillment.isLoading ||
    createClaimFulfillment.isLoading

  const notification = useNotification()

  const createFulfillment = () => {
    if (
      isFeatureEnabled("inventoryService") &&
      isFeatureEnabled("stockLocationService") &&
      !locationSelectValue.value
    ) {
      notification("Error", "Please select a location to fulfill from", "error")
      return
    }

    if (Object.keys(errors).length > 0) {
      notification(
        "Can't allow this action",
        "Trying to fulfill more than in stock",
        "error"
      )
      return
    }

    const [type] = orderToFulfill.id.split("_")

    type actionType =
      | typeof createOrderFulfillment
      | typeof createSwapFulfillment
      | typeof createClaimFulfillment

    let action: actionType = createOrderFulfillment
    let successText = "Successfully fulfilled order"
    let requestObj

    const preparedMetadata = metadata.reduce((acc, next) => {
      if (next.key) {
        return {
          ...acc,
          [next.key]: next.value,
        }
      } else {
        return acc
      }
    }, {})

    switch (type) {
      case "swap":
        action = createSwapFulfillment
        successText = "Successfully fulfilled swap"
        requestObj = {
          swap_id: orderToFulfill.id,
          metadata: preparedMetadata,
          no_notification: noNotis,
        } as AdminPostOrdersOrderSwapsSwapFulfillmentsReq
        break

      case "claim":
        action = createClaimFulfillment
        successText = "Successfully fulfilled claim"
        requestObj = {
          claim_id: orderToFulfill.id,
          metadata: preparedMetadata,
          no_notification: noNotis,
        } as AdminPostOrdersOrderClaimsClaimFulfillmentsReq
        break

      default:
        requestObj = {
          metadata: preparedMetadata,
          no_notification: noNotis,
        } as AdminPostOrdersOrderFulfillmentsReq

        requestObj.items = Object.entries(quantities)
          .filter(([, value]) => !!value)
          .map(([key, value]) => ({
            item_id: key,
            quantity: value,
          }))
        break
    }

    action.mutate(requestObj, {
      onSuccess: () => {
        notification("Success", successText, "success")
        handleCancel()
      },
      onError: (err) => notification("Error", getErrorMessage(err), "error"),
    })
  }

  return (
    <FocusModal>
      <FocusModal.Header>
        <div className="medium:w-8/12 flex w-full justify-between px-8">
          <Button
            size="small"
            variant="ghost"
            type="button"
            onClick={handleCancel}
          >
            <CrossIcon size={20} />
          </Button>
          <div className="gap-x-small flex">
            <Button
              size="small"
              variant="secondary"
              type="button"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="primary"
              type="submit"
              loading={isSubmitting}
              onClick={createFulfillment}
            >
              Create fulfillment
            </Button>
          </div>
        </div>
      </FocusModal.Header>
      <FocusModal.Main className="medium:w-6/12">
        <div className="pt-16">
          <h1 className="inter-xlarge-semibold">Create Fulfillment</h1>
          <div className="grid-col-1 grid gap-y-8 divide-y [&>*]:pt-8">
            <FeatureToggle featureFlag="inventoryService">
              <div className="grid grid-cols-2">
                <div>
                  <h2 className="inter-base-semibold">Locations</h2>
                  <span className="text-grey-50">
                    Choose where you wish to fulfill from.
                  </span>
                </div>
                <Select
                  isMulti={false}
                  options={locationOptions}
                  value={locationSelectValue}
                  onChange={(option) => {
                    setLocationSelectValue({
                      value: option?.value,
                      label: option?.label,
                    })
                  }}
                />
              </div>
            </FeatureToggle>
            <div className="flex flex-col">
              <span className="inter-base-semibold ">Items to fulfill</span>
              <span className="text-grey-50 mb-6">
                Select the number of items that you wish to fulfill.
              </span>
              <CreateFulfillmentItemsTable
                items={items}
                quantities={quantities}
                setQuantities={setQuantities}
                locationId={locationSelectValue.value}
                setErrors={setErrors}
              />
            </div>
            <div className="mt-4">
              <Metadata metadata={metadata} setMetadata={setMetadata} />
            </div>
            <div>
              <div className="mb-2xsmall flex items-center justify-between">
                <h2 className="inter-base-semibold">Send notifications</h2>
                <Switch
                  checked={!noNotis}
                  onCheckedChange={(checked) => setNoNotis(!checked)}
                />
              </div>
              <p className="inter-base-regular text-grey-50">
                When toggled, notification emails will be sent.
              </p>
            </div>
          </div>
        </div>
      </FocusModal.Main>
    </FocusModal>
  )
}

export default CreateFulfillmentModal