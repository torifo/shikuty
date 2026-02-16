class Municipality < ApplicationRecord
  self.table_name = "municipalities"

  scope :by_prefecture, ->(code) { where(prefecture_code: code) }
  scope :ordered, -> { order(:code) }

  def self.distinct_prefectures
    select(:prefecture_code, :prefecture_name)
      .distinct
      .order(:prefecture_code)
  end
end
