import {webDefaults,type LayoutPolicy} from '../policy'

// This snapshot stays inside one synchronous solve; public resolvePolicy still
// returns a frozen object. Copy overrides on every call to observe mutations.
export const streamPolicy=(overrides?:Partial<LayoutPolicy>):LayoutPolicy=>
  overrides?{...webDefaults,...overrides}:webDefaults
